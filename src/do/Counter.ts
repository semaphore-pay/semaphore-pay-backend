// Simple Generic Durable Object
import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
 
    // Storage is per-instance and durable across restarts/evictions.
    let count = (await this.ctx.storage.get<number>("count")) ?? 0;
 
    switch (url.pathname) {
      case "/increment":
        count++;
        await this.ctx.storage.put("count", count);
        break;
      case "/decrement":
        count--;
        await this.ctx.storage.put("count", count);
        break;
      case "/reset":
        count = 0;
        await this.ctx.storage.put("count", count);
        break;
      case "/":
        // just read, don't mutate
        break;
      default:
        return new Response("Not found. Try /, /increment, /decrement, /reset", {
          status: 404,
        });
    }
 
    return Response.json({ count });
  }
}