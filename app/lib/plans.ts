import { envInt } from "@/app/lib/rateLimit";

/*
 * Un singur plan deocamdata. Pretul se stabileste in Stripe (STRIPE_PRICE_ID),
 * iar numarul de povesti noi pe luna aici, din variabila de mediu, ca sa poata
 * fi schimbat din Railway fara deploy. Calculul care a dus la 4: la 10 lei raman
 * ~1,78 lei pentru costuri dupa TVA, comision Stripe si profitul tinta de 5 lei,
 * iar o poveste cu voce Azure costa ~0,38 lei.
 */
export const PLAN_NAME = "standard";

export const storiesPerMonth = () => envInt("STORIES_PER_MONTH", 4);

// Povesti de proba pentru conturile fara abonament, o singura data (nu pe luna)
export const freeStories = () => {
  const v = parseInt(process.env.FREE_STORIES ?? "", 10);
  return Number.isFinite(v) && v >= 0 ? v : 2;
};

export const billingEnabled = () =>
  !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_ID);
