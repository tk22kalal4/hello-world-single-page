
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingChatButtonProps {
  onClick: () => void;
  hasOcrText: boolean;
}

export const FloatingChatButton = ({ onClick, hasOcrText }: FloatingChatButtonProps) => {
  if (!hasOcrText) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Button
        onClick={onClick}
        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:scale-105"
        size="icon"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        <span className="sr-only">Open Chat</span>
      </Button>
    </div>
  );
};
