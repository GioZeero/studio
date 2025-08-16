
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface OverduePaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSubscriptionUpdate: (newExpiry: string) => void;
}

export function OverduePaymentModal({ isOpen, onOpenChange, user, onSubscriptionUpdate }: OverduePaymentModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePaymentConfirmed = async () => {
    if (!user || !db) return;

    setIsProcessing(true);
    const userRef = doc(db, 'users', user.name);
    const bankRef = doc(db, 'bank', 'total');
    
    const newExpiryDate = new Date();
    newExpiryDate.setMonth(newExpiryDate.getMonth() + 1, 0); // End of current month
    newExpiryDate.setHours(23, 59, 59, 999);
    
    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(userRef, { subscriptionExpiry: newExpiryDate.toISOString() });
        transaction.set(bankRef, { amount: increment(50) }, { merge: true });
      });

      onSubscriptionUpdate(newExpiryDate.toISOString());
      toast({
        title: 'Grazie!',
        description: 'Il tuo abbonamento è stato regolarizzato.',
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error settling overdue subscription:', error);
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
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pagamento Arretrato</AlertDialogTitle>
          <AlertDialogDescription>
            Non hai pagato il mese passato. Per continuare a usare il servizio, per favore, regolarizza la tua posizione.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="pt-4">
          <AlertDialogAction onClick={handlePaymentConfirmed} disabled={isProcessing} className="w-full">
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ho pagato entrambi i mesi (50€)
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

    