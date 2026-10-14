import type { User, Org } from "@weft/db/orgs";

export interface Ctx {
  req: Request;
  url: URL;
  ip: string;
  user?: User;
  org?: Org;
  session?: string;
  csrf: string;
  setCookie: (c: string) => void;
  headers: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<Response>;
export type Middleware = (ctx: Ctx, next: () => Promise<Response>) => Promise<Response>;

export function chain(...mw: Middleware[]): Handler {
  return async (ctx: Ctx) => {
    let i = -1;
    const dispatch = async (): Promise<Response> => {
      i++;
      if (i < mw.length) return mw[i](ctx, dispatch);
      return new Response("not found", { status: 404 });
    };
    return dispatch();
  };
}
