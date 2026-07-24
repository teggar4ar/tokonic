import { LockClosedIcon } from "@heroicons/react/24/outline";
import { redirect } from "next/navigation";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSellerForCurrentUser } from "@/server/data/seller";

type LoginPageProps = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await hasSellerForCurrentUser()) {
    redirect("/admin");
  }

  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(20rem,0.9fr)_minmax(28rem,1.1fr)]">
      <section className="flex bg-primary px-gutter py-12 text-primary-foreground lg:items-end lg:py-16">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground/70">Tokonic Admin</p>
          <h1 className="mt-4 max-w-lg text-[2rem] font-bold leading-[1.1] sm:text-4xl lg:text-[2.75rem]">
            Kelola toko dengan lebih terarah.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-primary-foreground/75">
            Akses operasional toko untuk mengelola katalog dan pesanan dalam satu tempat.
          </p>
        </div>
      </section>
      <section className="flex items-center px-gutter py-12 sm:py-16">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-primary">
              <LockClosedIcon className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>Masuk ke admin</CardTitle>
            <CardDescription>Gunakan akun admin Tokonic Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Kata sandi</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              {error ? (
                <p className="text-sm leading-5 text-destructive" role="alert">
                  Email atau kata sandi tidak valid.
                </p>
              ) : null}
              <Button type="submit" className="w-full">
                Masuk
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
