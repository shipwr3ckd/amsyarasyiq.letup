import { currentSettings } from "..";
import { Track } from "../../../defs";
import Constants from "../constants";
import { setDebugInfo } from "./debug";

/** Fetches the latest user's scrobble */
export async function fetchLatestScrobble(): Promise<Track & { from: number; to: number | null }> {
    const params = new URLSearchParams({
        method: "user.getrecenttracks",
        user: currentSettings.username,
        api_key: Constants.LFM_API_KEY,
        format: "json",
        limit: "1",
        extended: "1"
    }).toString();

    const result = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!result.ok) throw new Error(`Failed to fetch the latest scrobble: ${result.statusText}`);

    const info = await result.json();
    const lastTrack = info?.recenttracks?.track?.[0];
    setDebugInfo("lastAPIResponse", lastTrack);

    if (!lastTrack) throw info;

    const isNowPlaying = Boolean(lastTrack["@attr"]?.nowplaying);
    const from = isNowPlaying
        ? Math.floor(Date.now() / 1000)
        : parseInt(lastTrack?.date?.uts);
    let to: number = null;

    try {
        const trackInfoParams = new URLSearchParams({
            method: "track.getinfo",
            artist: lastTrack.artist.name,
            track: lastTrack.name,
            api_key: Constants.LFM_API_KEY,
            format: "json"
        }).toString();

        const trackInfoRes = await fetch(`https://ws.audioscrobbler.com/2.0/?${trackInfoParams}`);
        if (trackInfoRes.ok) {
            const trackInfo = await trackInfoRes.json();
            const durationMs = parseInt(trackInfo?.track?.duration ?? "0");
            if (durationMs > 0) {
                to = from + Math.floor(durationMs / 1000);
            }
        }
    } catch (err) {
        console.warn("Failed to fetch track duration", err);
    }

    return {
        name: lastTrack.name,
        artist: lastTrack.artist.name,
        album: lastTrack.album["#text"],
        albumArt: await handleAlbumCover(
            lastTrack.image?.find((x: any) => x.size === "large")?.["#text"]
        ),
        url: lastTrack.url,
        date: lastTrack.date?.["#text"] ?? "now",
        nowPlaying: isNowPlaying,
        loved: lastTrack.loved === "1",
        from,
        to,
    };
}

/** 
 * Currently ditches the default album covers 
 * @param cover The album cover given by Last.fm
*/
export async function handleAlbumCover(cover: string): Promise<string> {
    if (Constants.LFM_DEFAULT_COVER_HASHES.some(x => cover.includes(x))) {
        return null;
    }
    return cover;
}