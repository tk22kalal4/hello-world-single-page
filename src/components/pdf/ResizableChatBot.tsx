
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Send, X, Minimize2, Maximize2, GripHorizontal } from "lucide-react";
import { marked } from "marked";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResizableChatBotProps {
  ocrText: string;
  isVisible: boolean;
  onToggle: () => void;
}

export const ResizableChatBot = ({ ocrText, isVisible, onToggle }: ResizableChatBotProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I can answer questions about the PDF content. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatHeight, setChatHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isVisible && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isVisible]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = chatHeight;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const deltaY = startYRef.current - e.clientY;
    const newHeight = Math.max(200, Math.min(600, startHeightRef.current + deltaY));
    setChatHeight(newHeight);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isProcessing) return;
    
    if (!GROQ_API_KEY) {
      toast.error("Groq API key not configured. Please check your environment variables.");
      return;
    }
    
    const userMessage = { role: "user" as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setIsProcessing(true);
    
    let loadingToastId: string | number = "";
    
    try {
      setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);
      
      loadingToastId = toast.loading("Processing your question...", {
        duration: 15000,
        position: "top-right"
      });
      
      const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
      
      const requestBody = {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "system",
            content: `You are a helpful teacher that answers questions about PDF content in the ABSOLUTE SIMPLEST language possible.
              You are given OCR text extracted from a PDF document and must answer questions related to it — whether they are directly in the text or not.
              
              IMPORTANT: Your answers must be COMPLETE and include ALL relevant information from the PDF text.
              
              Follow these strict guidelines:
              
              1. Use EXTREMELY simple language — define and explain from basics as if to a 7-year-old student
              2. Format answers EXCLUSIVELY in bullet points (<ui> and <li>) with proper spacing between each point
              3. Every bullet point MUST be separated by one line break for readability
              4. Use <strong> HTML tags for important keywords, concepts and definitions
              5. Keep explanations complete — do not leave out ANY important details
              6. If asked to explain any concept, give 1-2 very simple examples
              7. If the answer is not in the text, use your own knowledge to help but mention this fact
              8. ALWAYS add helpful examples or real-life applications
              9. NEVER use technical or medical jargon - explain everything in simple terms
              10. ALWAYS format using HTML <ul><li> for bullet points with proper spacing
              11. Add clear line breaks between different parts of your answer
              12. If asked, create simple tables, comparisons, or explanations using HTML formatting
              13. Always be helpful and supportive
              14. NEVER skip any relevant information from the PDF text in your answer
              15. If the information is complex, break it down into multiple simple points
            
Here's the PDF content to reference:
${ocrText}

Please answer questions related to content.`
          },
          {
            role: "user",
            content: currentInput
          }
        ],
        temperature: 0.9,
        max_tokens: 1000
      };
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      setMessages(prev => prev.filter(m => m.content !== "Thinking..."));
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to get response from AI";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from API");
      }
      
      const aiResponse = data.choices[0].message.content;
      
      if (!aiResponse || aiResponse.trim() === "") {
        throw new Error("Empty response from AI");
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
      
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      toast.success("Response generated successfully!", { duration: 2000, position: "top-right" });
      
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      
      setMessages(prev => prev.filter(m => m.content !== "Thinking..."));
      
      let errorMessage = "Sorry, I encountered an error while processing your question.";
      
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        } else if (error.message.includes("401")) {
          errorMessage = "Authentication error. The Groq API key may be invalid.";
        } else if (error.message.includes("429")) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (error.message.includes("404")) {
          errorMessage = "The AI model is not available. Please try again later.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `${errorMessage} Please try again or rephrase your question.` 
      }]);
      
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      toast.error("Failed to generate response", { duration: 4000, position: "top-right" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay for mobile when chatbot is expanded */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      {/* Chatbot Container */}
      <div
        className={`fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border transition-all duration-300 ease-in-out ${
          isExpanded 
            ? 'w-full max-w-md' 
            : 'w-12 h-12'
        }`}
        style={{
          height: isExpanded ? `${chatHeight}px` : '48px',
          maxHeight: isExpanded ? '80vh' : '48px',
        }}
      >
        {/* Chatbot Toggle Button */}
        {!isExpanded && (
          <Button
            onClick={() => setIsExpanded(true)}
            className="w-full h-full rounded-lg bg-primary hover:bg-primary/90 transition-colors duration-200"
            size="icon"
          >
            <MessageSquare className="w-6 h-6 text-white" />
          </Button>
        )}

        {/* Expanded Chatbot Interface */}
        {isExpanded && (
          <div className="flex flex-col h-full">
            {/* Resize Handle */}
            <div
              ref={resizeRef}
              className="h-2 bg-gray-100 hover:bg-gray-200 cursor-row-resize flex items-center justify-center transition-colors duration-200 rounded-t-lg"
              onMouseDown={handleMouseDown}
            >
              <GripHorizontal className="w-4 h-4 text-gray-400" />
            </div>

            {/* Header */}
            <div className="p-3 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="text-base font-medium truncate">PDF Chat</h3>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsExpanded(false)}
                  className="shrink-0 h-8 w-8 p-0"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onToggle}
                  className="shrink-0 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-grow overflow-auto p-3 space-y-3">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      message.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}
                  >
                    {message.content === "Thinking..." ? (
                      <div className="flex items-center space-x-2">
                        <span>Thinking</span>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={`${
                          message.role === 'assistant' 
                            ? 'prose prose-sm prose-headings:my-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 dark:prose-invert max-w-none' 
                            : 'text-inherit'
                        }`}
                        dangerouslySetInnerHTML={{ 
                          __html: message.role === 'assistant' 
                            ? marked.parse(message.content) 
                            : message.content 
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="p-3 border-t bg-white shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the PDF content..."
                  className="flex-grow px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  disabled={isProcessing}
                />
                <Button 
                  type="submit" 
                  disabled={isProcessing || !input.trim()}
                  size="sm"
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};
