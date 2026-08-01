import { setRequestLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default async function DesignSystemPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen p-8 md:p-12 lg:p-16 max-w-7xl mx-auto space-y-12">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">Design System - moncabinetcric</h1>
        <p className="text-xl text-muted-foreground">Composants inspirés par PolicyPilot.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Boutons</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Default / Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive / Error</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Button size="lg">Large Button</Button>
          <Button size="default">Default Button</Button>
          <Button size="sm">Small Button</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Badges</h2>
        <div className="flex flex-wrap gap-4">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Inputs</h2>
        <div className="max-w-md space-y-4">
          <Input placeholder="Placeholder par défaut..." />
          <Input placeholder="Désactivé..." disabled />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Cartes (Cards)</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Carte Simple</CardTitle>
              <CardDescription>Ceci est une description de carte standard.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Contenu principal de la carte, utilisant les couleurs de la charte graphique.</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Action</Button>
            </CardFooter>
          </Card>
          
          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardHeader>
              <CardTitle>Carte Mise en Avant</CardTitle>
              <CardDescription className="text-primary-foreground/80">Peut être utilisée pour des métriques clés.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">142</div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
