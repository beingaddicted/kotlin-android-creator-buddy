
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

interface SetupConnectionCardProps {
  onStartServer: () => void;
}

export const SetupConnectionCard = ({ onStartServer }: SetupConnectionCardProps) => {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <QrCode className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Setup P2P Connection</h3>
        <p className="text-gray-500 mb-4">Generate connection QR codes to establish direct peer-to-peer communication with members.</p>
        <Button onClick={onStartServer}>
          <QrCode className="w-4 h-4 mr-2" />
          Generate Connection QR
        </Button>
      </CardContent>
    </Card>
  );
};
