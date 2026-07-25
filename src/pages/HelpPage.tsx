import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Search, HelpCircle, Book, MessageCircle, 
  ChevronRight, ChevronDown, ShoppingCart, User, CreditCard, Shield
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const HelpPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const categories = [
    { icon: ShoppingCart, label: "Buying", color: "bg-blue-500" },
    { icon: User, label: "Account", color: "bg-green-500" },
    { icon: CreditCard, label: "Payments", color: "bg-purple-500" },
    { icon: Shield, label: "Safety", color: "bg-amber-500" },
  ];

  const faqs = [
    {
      question: "How do I create an account?",
      answer: "Tap the Sign Up button on the home screen. Enter your email, phone number, and create a password. You'll receive a verification code to confirm your account."
    },
    {
      question: "How can I contact a seller?",
      answer: "On any product page, tap the 'Contact Seller' button to send a message. You can also call them directly if their phone number is available."
    },
    {
      question: "How do I post a product for sale?",
      answer: "First, upgrade to a seller account in your profile settings. Then tap 'Add Product' from your dashboard. Fill in the product details, add photos, and submit for review."
    },
    {
      question: "Is my payment information secure?",
      answer: "Yes! We use industry-standard encryption to protect all payment information. We never store your full card details on our servers."
    },
    {
      question: "How can I report a suspicious listing?",
      answer: "On any product page, tap the three dots menu and select 'Report'. Choose the reason and provide any additional details. Our team reviews all reports within 24 hours."
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary to-orange-500 pt-safe pb-6">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="font-semibold text-lg text-white">Help Center</h1>
        </div>

        {/* Search */}
        <div className="px-4 mt-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl bg-white border-0"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="p-4">
        <h3 className="font-semibold mb-3">Browse by Topic</h3>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat, index) => (
            <button 
              key={index}
              className="bg-card rounded-xl p-4 border hover:border-primary/50 transition-colors text-left flex items-center gap-3"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cat.color)}>
                <cat.icon className="h-5 w-5 text-white" />
              </div>
              <span className="font-medium">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="px-4">
        <h3 className="font-semibold mb-3">Frequently Asked Questions</h3>
        <div className="bg-card rounded-2xl border overflow-hidden divide-y">
          {faqs.map((faq, index) => (
            <div key={index}>
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent transition-colors"
              >
                <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                <span className="flex-1 font-medium text-sm">{faq.question}</span>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform",
                  expandedFaq === index && "rotate-180"
                )} />
              </button>
              {expandedFaq === index && (
                <div className="px-4 pb-4 pl-12">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="p-4 mt-4">
        <button 
          onClick={() => navigate('/support')}
          className="w-full bg-gradient-to-r from-primary to-orange-500 rounded-2xl p-4 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-white">Still need help?</p>
            <p className="text-white/80 text-sm">Contact our support team</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/70" />
        </button>
      </div>
    </div>
  );
};

export default HelpPage;
