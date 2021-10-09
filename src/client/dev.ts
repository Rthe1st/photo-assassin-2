export function testMode(): boolean {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1"
}
