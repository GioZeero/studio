'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dumbbell, Loader2, ShieldBan } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Home() {
  const [role, setRole] = useState<'owner' | 'client'>('client');
  const [name, setName] = useState('');
  const [hasPaid, setHasPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('gymUser');
    if (storedUser) {
      router.push('/agenda');
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !db) return;

    setIsSubmitting(true);
    const trimmedName = name.trim();

    try {
      const userRef = doc(db, 'users', trimmedName);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const existingUser = userSnap.data();

        if (existingUser.isBlocked) {
            setIsBlocked(true);
            setIsSubmitting(false);
            return;
        }

        if (existingUser.role !== role) {
          toast({
            variant: "destructive",
            title: "Errore di ruolo",
            description: `Un utente con questo nome esiste già come ${existingUser.role}.`,
          });
          setIsSubmitting(false);
          return;
        }
        localStorage.setItem('gymUser', JSON.stringify({ name: trimmedName, role }));
        router.push(`/agenda`);

      } else {
        const newUser: { name: string; role: 'owner' | 'client'; subscriptionExpiry?: string, isBlocked?: boolean } = {
          name: trimmedName,
          role: role,
          isBlocked: false,
        };

        if (role === 'client' && hasPaid) {
          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + 1, 0); 
          expiryDate.setHours(23, 59, 59, 999);
          newUser.subscriptionExpiry = expiryDate.toISOString();
          
          const bankRef = doc(db, 'bank', 'total');
          const bankSnap = await getDoc(bankRef);
          if (!bankSnap.exists()) {
              await setDoc(bankRef, { amount: 25 });
          } else {
              await setDoc(bankRef, { amount: (bankSnap.data().amount || 0) + 25 }, { merge: true });
          }
        }

        await setDoc(userRef, newUser);
        localStorage.setItem('gymUser', JSON.stringify({ name: trimmedName, role }));
        router.push(`/agenda`);
      }
    } catch (error) {
      console.error("Error during login/registration:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Qualcosa è andato storto. Riprova.",
      });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-5 w-56 mx-auto mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-4 pt-2">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
            </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <>
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-md shadow-2xl animate-fade-in-up">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <Dumbbell size={40} strokeWidth={2.5} />
          </div>
          <CardTitle className="text-3xl font-headline">Benvenuto su GymAgenda</CardTitle>
          <CardDescription>Per iniziare, dicci chi sei.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Io sono...</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as 'owner' | 'client')} className="flex gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="client" id="r-client" />
                  <Label htmlFor="r-client">Cliente</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="owner" id="r-owner" />
                  <Label htmlFor="r-owner">Proprietario</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Il mio nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="es. Mario Rossi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {role === 'client' && (
              <div className="flex items-center space-x-2">
                <Checkbox id="paid" checked={hasPaid} onCheckedChange={(checked) => setHasPaid(!!checked)} />
                <label
                  htmlFor="paid"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Pagato mese corrente
                </label>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!name.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continua
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
    <AlertDialog open={isBlocked} onOpenChange={setIsBlocked}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldBan className="h-6 w-6 text-destructive" />
                    Account Bloccato
                </AlertDialogTitle>
                <AlertDialogDescription>
                    Il tuo account è stato bloccato dal proprietario della palestra. Contattalo per maggiori informazioni.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsBlocked(false)}>Ho capito</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
