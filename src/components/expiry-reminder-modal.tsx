'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ExpiryReminderModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSubscriptionUpdate: (newExpiry: string) => void;
}

export function ExpiryReminderModal({ isOpen, onOpenChange, user, onSubscriptionUpdate }: ExpiryReminderModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentConfirmed = async () => {
    if (!user || !db) return;

    setIsProcessing(true);
    const userRef = doc(db, 'users', user.name);
    const bankRef = doc(db, 'bank', 'total');
    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1, 0); 
    newExpiryDate.setHours(23, 59, 59, 999);
    
    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(userRef, { subscriptionExpiry: newExpiryDate.toISOString() });
        transaction.set(bankRef, { amount: increment(25) }, { merge: true });
      });

      onSubscriptionUpdate(newExpiryDate.toISOString());
      toast({
        title: 'Grazie!',
        description: 'Il tuo abbonamento è stato rinnovato per il mese corrente.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error renewing subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiornare l\'abbonamento. Contatta il proprietario.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abbonamento Scaduto</AlertDialogTitle>
          <AlertDialogDescription>
            Il tuo abbonamento è scaduto o non è stato ancora pagato. Per continuare a prenotare, per favore, rinnova.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Pagherò, sono povero
          </Button>
          <AlertDialogAction onClick={handlePaymentConfirmed} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pagamento effettuato
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
