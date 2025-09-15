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
import { format, isPast } from 'date-fns';
import { it } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, runTransaction, increment, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Separator } from './ui/separator';

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

        transaction.update(userRef, { subscriptionExpiry: finalExpiryDate.toISOString(), subscriptionStatus: 'active' });
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

  const handleToggleSuspend = async () => {
    if (!user || !db || isProcessing) return;
    setIsProcessing(true);

    const userRef = doc(db, 'users', user.name);
    const newStatus = user.subscriptionStatus === 'suspended' ? 'expired' : 'suspended';
    
    try {
        await updateDoc(userRef, { subscriptionStatus: newStatus });
        toast({
            title: 'Successo!',
            description: `Abbonamento ${newStatus === 'suspended' ? 'sospeso' : 'riattivato'}.`,
        });
        // This is a local update to avoid a full re-fetch, UI will update instantly
        user.subscriptionStatus = newStatus;
    } catch (error) {
        console.error('Error suspending subscription:', error);
        toast({
            variant: 'destructive',
            title: 'Errore',
            description: 'Impossibile aggiornare lo stato dell\'abbonamento.',
        });
    } finally {
        setIsProcessing(false);
        onOpenChange(false);
    }
  };

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: it });
  
  const getStatusText = () => {
    switch (user.subscriptionStatus) {
      case 'active':
        return `Attivo fino al ${format(new Date(user.subscriptionExpiry!), 'dd MMMM yyyy', { locale: it })}`;
      case 'suspended':
        return 'Sospeso';
      case 'overdue':
        return 'Arretrati';
      case 'expired':
        return 'Scaduto';
      default:
        return 'Scaduto';
    }
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Il Mio Abbonamento</DialogTitle>
            <DialogDescription>
              Gestisci la scadenza e lo stato del tuo abbonamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Mese Corrente</p>
              <p className="font-semibold capitalize">{currentMonth}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Stato Abbonamento</p>
              <p className="font-semibold capitalize">{getStatusText()}</p>
            </div>

            {(user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'suspended') && (
              <>
                <Separator />
                <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleToggleSuspend}
                    disabled={isProcessing}
                >
                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {user.subscriptionStatus === 'suspended' ? 'Riattiva Abbonamento' : 'Sospendi Abbonamento'}
                </Button>
                <p className="text-xs text-center text-muted-foreground px-4">
                    {user.subscriptionStatus === 'suspended' ? 'Riattiva per poter rinnovare.' : 'Sospendi per non ricevere più avvisi di pagamento.'}
                </p>
              </>
            )}

          </div>
          
          {user.subscriptionStatus !== 'suspended' && user.subscriptionStatus !== 'overdue' && (
            <DialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2 border-t pt-6">
                <p className="text-sm text-center text-muted-foreground">Rinnova il tuo abbonamento:</p>
                <div className="grid grid-cols-3 gap-2">
                {options.map((opt) => (
                    <Button key={opt.months} onClick={() => handleOptionClick(opt)} disabled={isProcessing}>
                    +{opt.months} {opt.months > 1 ? 'Mesi' : 'Mese'}
                    </Button>
                ))}
                </div>
            </DialogFooter>
          )}

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
