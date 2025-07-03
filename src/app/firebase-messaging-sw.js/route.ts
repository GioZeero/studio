import { NextResponse } from 'next/server';

export async function GET() {
  const scriptContent = `
    self.addEventListener('install', (event) => {
      // Dice al nuovo service worker di attivarsi immediatamente
      // invece di aspettare che tutti i client esistenti vengano chiusi.
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      // Permette a un service worker attivo di prendere il controllo
      // di tutti i client (pagine/tab) nel suo scope.
      event.waitUntil(self.clients.claim());
    });

    self.addEventListener('push', (event) => {
      if (!event.data) {
        return;
      }

      let payload;
      try {
        payload = event.data.json();
      } catch (e) {
        payload = { data: { notificationTitle: 'New Message', notificationBody: event.data.text() } };
      }

      const title = payload.data?.notificationTitle || 'GymAgenda';
      const options = {
        body: payload.data?.notificationBody || 'You have a new notification.',
        // Puoi aggiungere altre opzioni qui, come icona, badge, ecc.
        // icon: '/icon-192x192.png',
      };

      event.waitUntil(self.registration.showNotification(title, options));
    });
  `;

  return new Response(scriptContent, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Metti in cache il service worker per 1 settimana.
      // Questo impedisce al browser di ricontrollarlo e reinstallarlo
      // continuamente, che è la causa delle notifiche di "sito aggiornato".
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
    },
  });
}
