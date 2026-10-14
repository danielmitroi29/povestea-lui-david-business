import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { pool } from "@/app/lib/db";
import { PLAN_NAME, billingEnabled, storiesPerMonth } from "@/app/lib/plans";

/*
 * Conturi (email + parola, plus Google daca exista GOOGLE_CLIENT_ID) si
 * abonamente Stripe. Plugin-ul Stripe se ocupa de pagina de plata, de portalul
 * de facturare si de webhook-ul /api/auth/stripe/webhook, care tine tabela
 * `subscription` la zi (plata, reinnoire, anulare, card refuzat).
 */
const plugins: BetterAuthPlugin[] = [];

if (billingEnabled()) {
  plugins.push(stripe({
    stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY!),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: [{
        name: PLAN_NAME,
        priceId: process.env.STRIPE_PRICE_ID!,
        limits: { stories: storiesPerMonth() },
      }],
    },
  }));
}

// nextCookies trebuie sa fie ultimul plugin
plugins.push(nextCookies());

export const authOptions = {
  database: pool,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {},
  plugins,
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

/** Utilizatorul din cookie-ul cererii, sau null daca nu e autentificat. */
export async function currentUser(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user ?? null;
}
