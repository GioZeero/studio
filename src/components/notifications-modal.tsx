'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { ClientData } from '@/lib/types';
import { format, isPast } from 'date-fns';
import { it } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { AlertCircle, Bell } from 'lucide-react';

interface Notification {
  id: string;
  message: string;
  date: Date;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsModal({ isOpen, onOpenChange }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !db) return;

    const fetchExpiredSubscriptions = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const querySnapshot = await getDocs(q);
        const clientList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ClientData[];

        const expiredNotifications = clientList
          .filter(client => client.subscriptionExpiry && isPast(new Date(client.subscriptionExpiry)))
          .map(client => ({
            id: client.id,
            message: `L'abbonamento di ${client.name} è scaduto.`,
            date: new Date(client.subscriptionExpiry!),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        setNotifications(expiredNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExpiredSubscriptions();
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifiche
          </DialogTitle>
          <DialogDescription>
            Qui trovi gli aggiornamenti importanti sugli abbonamenti dei clienti.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 border rounded-md p-2">
            <div className="space-y-4 p-2">
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <Skeleton className="h-5 w-5 rounded-full mt-1" />
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    ))
                ) : notifications.length > 0 ? (
                    notifications.map(notification => (
                        <div key={notification.id} className="flex items-start gap-4">
                            <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-medium">{notification.message}</p>
                                <p className="text-sm text-muted-foreground">
                                    Scaduto il: {format(notification.date, 'dd MMMM yyyy', { locale: it })}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-10">
                        <p>Non ci sono nuove notifiche.</p>
                        <p className="text-sm">Tutti gli abbonamenti sono in regola!</p>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
