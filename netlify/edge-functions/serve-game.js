import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const url = new URL(request.url);
  const fileKey = url.searchParams.get("key"); 

  // --- DEBUG LOGGING (Check Netlify Function Logs if errors persist) ---
  console.log(`[ServeGame] Request for key: ${fileKey}`);
  
  // --- SECURITY CHECK ---
  const referer = request.headers.get("referer");
  // Origin is often null for simple GET requests, so we rely heavily on Referer
  const origin = request.headers.get("origin"); 
  
  // Dynamic Host Check: Allow requests if they come from the SAME hostname as this function
  // This makes it work on localhost, deploy previews, and production automatically.
  const currentHost = url.hostname; 
  
  // Helper to check if a string contains our current host
  const isValidSource = (source) => source && source.includes(currentHost);

  const isAllowed = isLocal(url) || isValidSource(referer) || isValidSource(origin);

  if (!isAllowed) {
    console.error(`[ServeGame] Blocked. Referer: ${referer}, Origin: ${origin}, Host: ${currentHost}`);
    return new Response("Forbidden: Hotlinking not allowed.", { status: 403 });
  }

  // --- FETCH & STREAM ---
  if (!fileKey) return new Response("File not specified", { status: 400 });

  try {
    const store = getStore("game_assets");
    const blob = await store.get(fileKey, { type: "blob" });

    if (!blob) {
      console.error(`[ServeGame] Blob not found for key: ${fileKey}`);
      return new Response("File not found", { status: 404 });
    }

    return new Response(blob, {
      headers: {
        "Content-Type": fileKey.endsWith(".zip") ? "application/zip" : "application/octet-stream",
        "Content-Length": blob.size.toString(),
        "Access-Control-Allow-Origin": "*", 
        "Cache-Control": "public, max-age=31536000, immutable" 
      }
    });
  } catch (error) {
    console.error(`[ServeGame] Error fetching blob:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

function isLocal(url) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

export const config = { path: "/api/serve-game/*" };
