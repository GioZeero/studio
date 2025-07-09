'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { ClientData, Goal } from '@/lib/types';
import { format, isPast } from 'date-fns';
import { it } from 'date-fns/locale';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';
import { AlertCircle, Bell, Trophy } from 'lucide-react';

interface Notification {
  id: string;
  message: string;
  date: Date;
  type: 'subscription' | 'goal';
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

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // Fetch expired subscriptions
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'client'));
        const usersSnapshot = await getDocs(usersQuery);
        const clientList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClientData[];

        const subscriptionNotifications: Notification[] = clientList
          .filter(client => client.subscriptionExpiry && isPast(new Date(client.subscriptionExpiry)))
          .map(client => ({
            id: `sub-${client.id}`,
            message: `L'abbonamento di ${client.name} è scaduto.`,
            date: new Date(client.subscriptionExpiry!),
            type: 'subscription'
          }));

        // Fetch completed goals
        const goalsQuery = query(collection(db, 'goals'), where('status', '==', 'completed'), orderBy('completedAt', 'desc'));
        const goalsSnapshot = await getDocs(goalsQuery);
        const goalNotifications: Notification[] = goalsSnapshot.docs.map(doc => {
            const goal = {id: doc.id, ...doc.data()} as Goal;
            return {
                id: `goal-${goal.id}`,
                message: `Obiettivo Raggiunto: ${goal.name}!`,
                date: new Date(goal.completedAt!),
                type: 'goal'
            };
        });

        const allNotifications = [...subscriptionNotifications, ...goalNotifications];
        allNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());

        setNotifications(allNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen]);
  
  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
        case 'subscription':
            return <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />;
        case 'goal':
            return <Trophy className="h-5 w-5 text-yellow-500 mt-1 flex-shrink-0" />;
        default:
            return <Bell className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifiche
          </DialogTitle>
          <DialogDescription>
            Qui trovi gli aggiornamenti importanti sugli abbonamenti e gli obiettivi.
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
                            {getNotificationIcon(notification.type)}
                            <div>
                                <p className="font-medium">{notification.message}</p>
                                <p className="text-sm text-muted-foreground">
                                    {format(notification.date, 'dd MMMM yyyy', { locale: it })}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground py-10">
                        <p>Non ci sono nuove notifiche.</p>
                    </div>
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
