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
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const goalSchema = z.object({
  name: z.string().min(1, { message: 'Il nome è obbligatorio.' }),
  cost: z.coerce.number().positive({ message: 'Il costo deve essere un numero positivo.' }),
});

type GoalFormValues = z.infer<typeof goalSchema>;

interface AddGoalModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalAdded: () => void;
}

export function AddGoalModal({ isOpen, onOpenChange, onGoalAdded }: AddGoalModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      cost: 0,
    },
  });

  const onSubmit: SubmitHandler<GoalFormValues> = async (data) => {
    if (!db) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'goals'), {
        name: data.name,
        cost: data.cost,
        status: 'active',
        createdAt: new Date().toISOString(),
      });

      toast({
        title: 'Successo!',
        description: 'Il nuovo obiettivo è stato aggiunto.',
      });
      onGoalAdded();
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding goal:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: "Impossibile aggiungere l'obiettivo. Riprova.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Nuovo Obiettivo</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli dell'obiettivo. La barra di progresso si aggiornerà in base ai fondi in cassa.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Obiettivo</FormLabel>
                  <FormControl>
                    <Input placeholder="es. Comprare nuovo rack" {...field} />
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
                  <FormLabel>Costo Obiettivo (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="es. 2000" {...field} />
                  </FormControl>
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
                    Aggiungi Obiettivo
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
