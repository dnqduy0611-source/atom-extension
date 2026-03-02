import * as net from "net";

/**
 * Find an available TCP port on localhost.
 * Creates a temporary server on port 0 (OS assigns free port),
 * captures the assigned port, then closes the server.
 */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Failed to get port from server address"));
        return;
      }

      const { port } = address;
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(port);
        }
      });
    });

    server.on("error", reject);
  });
}
