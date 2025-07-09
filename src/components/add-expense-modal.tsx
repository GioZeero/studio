'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { runTransaction, doc, collection, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const expenseSchema = z.object({
  name: z.string().min(1, { message: 'Il nome è obbligatorio.' }),
  cost: z.coerce.number().positive({ message: 'Il costo deve essere un numero positivo.' }),
  date: z.date({ required_error: 'La data è obbligatoria.' }),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface AddExpenseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded: () => void;
}

export function AddExpenseModal({ isOpen, onOpenChange, onExpenseAdded }: AddExpenseModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: '',
      cost: 0,
      date: new Date(),
    },
  });

  const onSubmit: SubmitHandler<ExpenseFormValues> = async (data) => {
    if (!db) return;
    setIsSubmitting(true);

    try {
      await runTransaction(db, async (transaction) => {
        const bankRef = doc(db, 'bank', 'total');
        const bankSnap = await transaction.get(bankRef);
        
        const currentAmount = bankSnap.exists() ? bankSnap.data().amount : 0;
        const newAmount = currentAmount - data.cost;

        transaction.set(bankRef, { amount: newAmount }, { merge: true });
        
        const newExpenseRef = doc(collection(db, 'expenses'));
        const newExpense = {
          name: data.name,
          cost: data.cost,
          date: data.date.toISOString(),
        };
        transaction.set(newExpenseRef, newExpense);
      });

      toast({
        title: 'Successo!',
        description: 'La spesa è stata aggiunta correttamente.',
      });
      onExpenseAdded();
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile aggiungere la spesa. Riprova.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuova Spesa</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli della spesa. Il costo verrà sottratto dal totale in cassa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Spesa</FormLabel>
                  <FormControl>
                    <Input placeholder="es. Nuovi pesi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="es. 150" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data Spesa</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: it })
                          ) : (
                            <span>Scegli una data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    Annulla
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Aggiungi Spesa
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
