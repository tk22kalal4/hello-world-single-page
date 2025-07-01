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
            content: `You are a helpful teacher that answers questions related to PDF content using structured, well-formatted responses.

FORMATTING REQUIREMENTS - STRICTLY FOLLOW:

1. **Always start with a title using <h3><strong>Title: [Your Topic]</strong></h3>**

2. **Use EMOJI BULLET POINTS for all lists:**
   - Main points: Use 🔹 or 📌 or ⭐ 
   - Sub-points: Use 🔸 or ➤ or ▪️
   - Steps: Use 1️⃣ 2️⃣ 3️⃣ or 📝 📋 ✅

3. **FORCE BULLET POINT FORMAT - Never use regular text paragraphs:**
   - Always use <ul><li> tags with emoji bullets
   - Add proper spacing with <br/> tags
   - Use <strong> for emphasis

4. **Example structure to ALWAYS follow:**
   <h3><strong>Title: Your Response Topic</strong></h3>
   <ul>
   <li>🔹 <strong>Main Point 1</strong>:<br/>
   🔸 Sub-point explanation<br/>
   🔸 Another sub-point with details</li>
   <br/>
   <li>📌 <strong>Main Point 2</strong>:<br/>
   🔸 Clear explanation in simple terms<br/>
   🔸 Real-life example or application</li>
   </ul>

5. **For numbered steps, use emoji numbers:**
   <ol>
   <li>1️⃣ <strong>First step</strong>: Explanation</li>
   <li>2️⃣ <strong>Second step</strong>: Details</li>
   <li>3️⃣ <strong>Final step</strong>: Conclusion</li>
   </ol>

CONTENT REQUIREMENTS:
- Use EXTREMELY simple language (7-year-old level)
- Give specific answer according to user's question related to pdf content
- Add helpful examples and real-life applications
- Add famous mnemonics related to relavent information
- Break complex information into simple emoji bullet point
- Always be supportive and encouraging

PDF Content:
${ocrText}

REMEMBER: ALWAYS use the structured format with emoji bullets - NEVER respond in plain paragraphs!`
          },
          {
            role: "user",
            content: currentInput
          }
        ],
        temperature: 0.5,
        max_tokens: 2000
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
                            ? 'prose prose-sm prose-headings:my-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-ol:my-2 dark:prose-invert max-w-none [&_ul]:list-none [&_ol]:list-none [&_li]:pl-0' 
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
