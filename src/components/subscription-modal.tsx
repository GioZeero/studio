'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { User } from '@/lib/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface SubscriptionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  onSubscriptionUpdate: (newExpiry: string) => void;
}

type SubscriptionOption = {
  months: number;
  price: number;
};

export function SubscriptionModal({ isOpen, onOpenChange, user, onSubscriptionUpdate }: SubscriptionModalProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SubscriptionOption | null>(null);
  const { toast } = useToast();

  const options: SubscriptionOption[] = [
    { months: 1, price: 25 },
    { months: 2, price: 50 },
    { months: 4, price: 100 },
  ];

  const handleOptionClick = (option: SubscriptionOption) => {
    setSelectedOption(option);
    setConfirmOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOption || !user || !db) return;

    setIsProcessing(true);
    const userRef = doc(db, 'users', user.name);
    const bankRef = doc(db, 'bank', 'total');

    try {
      const newExpiryDate = await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document does not exist!");
        }

        const userData = userDoc.data();
        const currentExpiry = userData.subscriptionExpiry ? new Date(userData.subscriptionExpiry) : new Date(0);
        const now = new Date();
        const isExpired = currentExpiry <= now;
        
        const baseDate = isExpired ? now : currentExpiry;
        const monthsToAdd = isExpired ? selectedOption.months - 1 : selectedOption.months;

        const updatedExpiryDate = new Date(baseDate);
        if (monthsToAdd >= 0) {
          updatedExpiryDate.setMonth(updatedExpiryDate.getMonth() + monthsToAdd);
        }

        const finalExpiryDate = new Date(updatedExpiryDate.getFullYear(), updatedExpiryDate.getMonth() + 1, 0);
        finalExpiryDate.setHours(23, 59, 59, 999);

        transaction.update(userRef, { subscriptionExpiry: finalExpiryDate.toISOString() });
        transaction.set(bankRef, { amount: increment(selectedOption.price) }, { merge: true });
        
        return finalExpiryDate;
      });

      onSubscriptionUpdate(newExpiryDate.toISOString());
      toast({
        title: 'Successo!',
        description: 'Abbonamento aggiornato con successo.',
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiornare l\'abbonamento.',
      });
    } finally {
      setIsProcessing(false);
      setConfirmOpen(false);
      onOpenChange(false);
    }
  };

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: it });
  const expiryDate = user.subscriptionExpiry
    ? format(new Date(user.subscriptionExpiry), 'dd MMMM yyyy', { locale: it })
    : 'N/A';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Il Mio Abbonamento</DialogTitle>
            <DialogDescription>
              Gestisci la scadenza del tuo abbonamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Mese Corrente</p>
              <p className="font-semibold capitalize">{currentMonth}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Scadenza Abbonamento</p>
              <p className="font-semibold capitalize">{expiryDate}</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
            <p className="text-sm text-center text-muted-foreground">Rinnova il tuo abbonamento:</p>
            <div className="grid grid-cols-3 gap-2">
              {options.map((opt) => (
                <Button key={opt.months} onClick={() => handleOptionClick(opt)}>
                  +{opt.months} {opt.months > 1 ? 'Mesi' : 'Mese'}
                </Button>
              ))}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {selectedOption && (
        <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Conferma Pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Confermi di aver pagato {selectedOption.price}€ alla Banca per rinnovare l'abbonamento di {selectedOption.months} {selectedOption.months > 1 ? 'mesi' : 'mese'}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmPayment} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confermo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
