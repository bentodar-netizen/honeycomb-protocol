import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hexagon, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-16 px-6 md:px-8 lg:px-12 max-w-7xl mx-auto">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-12 text-center">
          <Hexagon className="h-20 w-20 text-muted-foreground/50" />
          <div>
            <h1 className="text-4xl font-bold mb-2">404</h1>
            <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This cell seems to have flown away from the hive.
            </p>
            <Link href="/">
              <Button className="gap-2" data-testid="button-go-home">
                <ArrowLeft className="h-4 w-4" />
                Back to Hive
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
