// Auth.js v5 module augmentation: expose the stable user id on the client session.
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
