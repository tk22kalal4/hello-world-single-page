import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Send, X } from "lucide-react";
import { marked } from "marked";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBotProps {
  ocrText: string;
  onClose: () => void;
}

export const ChatBot = ({ ocrText, onClose }: ChatBotProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I can answer questions about the PDF content. What would you like to know?" }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use environment variable for Groq API key
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // Add thinking message
      setMessages(prev => [...prev, { role: "assistant", content: "Thinking..." }]);
      
      loadingToastId = toast.loading("Processing your question...", {
        duration: 15000,
        position: "top-right"
      });
      
      const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
      
      console.log("Making API request to Groq...");
      console.log("Using API Key:", GROQ_API_KEY ? GROQ_API_KEY.substring(0, 20) + "..." : "Not provided");
      
      const requestBody = {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "system",
            content: `You are a helpful teacher that answers questions related to OCR text from a PDF. You can also use your own knowledge when the answer isn't in the OCR text, ensuring the user's doubt is clarified effectively.
      
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
      - Always prioritize answering the user's question clearly and specifically
      - Relate the answer to the OCR text whenever possible, explaining the relevant sections
      - If the answer isn't in the OCR text, use your own knowledge to clarify the user's doubt
      - Add helpful examples, real-life applications, and famous mnemonics when relevant
      - Break complex information into simple emoji bullet points
      - Always be supportive and encouraging
      
      OCR Content:
      ${ocrText}
      
      When the user asks a question, answer by referencing the OCR text if relevant, but feel free to use external knowledge if needed to ensure the user's doubt is fully addressed. Always be clear, supportive, and well-formatted according to the above guidelines.`
          },
          {
            role: "user",
            content: currentInput
          }
        ],
        temperature: 0.5,
        max_tokens: 2000
      };
      console.log("Request body:", requestBody);
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      
      // Remove thinking message
      setMessages(prev => prev.filter(m => m.content !== "Thinking..."));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        
        let errorMessage = "Failed to get response from AI";
        try {
          const errorData = JSON.parse(errorText);
          console.error("Parsed error data:", errorData);
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch (e) {
          console.error("Error parsing error response:", e);
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("API response data:", data);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid response structure:", data);
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
      
      // Remove thinking message if it exists
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

  return (
    <div className="flex flex-col h-full border-l bg-white">
      {/* Header - Mobile optimized */}
      <div className="p-3 md:p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="text-base md:text-lg font-medium truncate">PDF Chat</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Messages - Scrollable area */}
      <div className="flex-grow overflow-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[85%] md:max-w-[80%] rounded-lg p-3 text-sm md:text-base ${
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
                      ? 'prose prose-sm md:prose prose-headings:my-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-ol:my-2 dark:prose-invert max-w-none [&_ul]:list-none [&_ol]:list-none [&_li]:pl-0' 
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
      
      {/* Input form - Mobile optimized */}
      <form onSubmit={handleSubmit} className="p-3 md:p-4 border-t bg-white shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the PDF content..."
            className="flex-grow px-3 py-2 text-sm md:text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
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
  );
};
