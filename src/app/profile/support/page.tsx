'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MessageCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export default function SupportPage() {
  const router = useRouter();

  const faqs = [
    {
      q: "How do I verify my account?",
      a: "Go to your profile page. If you are a landlord, you will see a 'Verification' section. Upload a valid ID card (NIN, Driver's License) and a selfie holding the ID."
    },
    {
      q: "Is Zik-Lodge Finder free?",
      a: "Yes, searching for lodges is completely free for students. Landlords can also post listings for free."
    },
    {
      q: "How do I delete my account?",
      a: "You can delete your account from the Profile page. Scroll to the bottom and click 'Delete Account'. This action is irreversible."
    },
    {
      q: "I found a bug, how do I report it?",
      a: "Please send us a message on WhatsApp or email us with details about the issue."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 pb-20">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
      </header>

      <div className="space-y-6">
        {/* Contact Channels */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Us</h2>
          <div className="space-y-4">
            <a 
              href="mailto:unizikampus@gmail.com" 
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Mail size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Email Support</div>
                <div className="text-xs text-gray-500">unizikampus@gmail.com</div>
              </div>
            </a>
            
            <a 
              href="https://wa.me/234707701331" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                <MessageCircle size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">WhatsApp</div>
                <div className="text-xs text-gray-500">Chat with our team</div>
              </div>
            </a>

            <a 
              href="tel:+2347016159288" 
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                <Phone size={20} />
              </div>
              <div>
                <div className="font-bold text-gray-900">Call Us</div>
                <div className="text-xs text-gray-500">Mon - Fri, 9am - 5pm</div>
              </div>
            </a>
          </div>
        </section>

        {/* FAQs */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 ml-1">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 text-left font-bold text-gray-700 hover:bg-gray-50"
      >
        <span className="text-sm">{question}</span>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}
