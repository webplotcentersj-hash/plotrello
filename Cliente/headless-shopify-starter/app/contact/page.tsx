'use client'

import { useState } from 'react'
import { Mail, MapPin, Phone, Send, Clock, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const contactInfo = [
  {
    icon: Mail,
    title: 'Email',
    content: 'hello@dripnex.com',
    description: 'Send us an email anytime',
  },
  {
    icon: Phone,
    title: 'Phone',
    content: '+1 (555) 123-4567',
    description: 'Mon-Fri from 9am to 6pm',
  },
  {
    icon: MapPin,
    title: 'Location',
    content: 'New York, NY',
    description: 'United States',
  },
  {
    icon: Clock,
    title: 'Response Time',
    content: 'Within 24 hours',
    description: 'Usually much faster',
  },
]

const faqs = [
  {
    question: 'What is your shipping policy?',
    answer:
      'We offer free standard shipping on all orders over $100. Standard shipping takes 5-7 business days. Express shipping is available for an additional fee.',
  },
  {
    question: 'What is your return policy?',
    answer:
      'We accept returns within 30 days of purchase. Items must be unworn, unwashed, and in original packaging. Contact us to initiate a return.',
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'Yes! We ship to over 30 countries worldwide. International shipping rates and delivery times vary by location.',
  },
  {
    question: 'How can I track my order?',
    answer:
      'Once your order ships, you will receive an email with tracking information. You can also check your order status in your account.',
  },
]

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSubmitting(false)
    setIsSubmitted(true)
    setFormState({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="py-12 lg:py-16 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-primary font-medium tracking-widest uppercase mb-2">
            Get in Touch
          </p>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wider text-foreground">
            CONTACT US
          </h1>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact Form */}
            <div>
              <h2 className="font-heading text-3xl tracking-wider text-foreground mb-6">
                SEND US A MESSAGE
              </h2>
              <p className="text-muted-foreground mb-8">
                Have a question or feedback? We would love to hear from you. Fill out the form below and we will get back to you as soon as possible.
              </p>

              {isSubmitted ? (
                <div className="bg-secondary border border-primary rounded-lg p-8 text-center">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-heading text-2xl tracking-wider text-foreground mb-2">
                    MESSAGE SENT!
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Thank you for reaching out. We will get back to you within 24 hours.
                  </p>
                  <Button
                    onClick={() => setIsSubmitted(false)}
                    variant="outline"
                    className="font-heading tracking-wider"
                  >
                    SEND ANOTHER MESSAGE
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-foreground mb-2"
                      >
                        Name
                      </label>
                      <Input
                        id="name"
                        type="text"
                        value={formState.name}
                        onChange={(e) =>
                          setFormState({ ...formState, name: e.target.value })
                        }
                        required
                        className="bg-secondary border-border"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-foreground mb-2"
                      >
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={formState.email}
                        onChange={(e) =>
                          setFormState({ ...formState, email: e.target.value })
                        }
                        required
                        className="bg-secondary border-border"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Subject
                    </label>
                    <Input
                      id="subject"
                      type="text"
                      value={formState.subject}
                      onChange={(e) =>
                        setFormState({ ...formState, subject: e.target.value })
                      }
                      required
                      className="bg-secondary border-border"
                      placeholder="How can we help?"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      value={formState.message}
                      onChange={(e) =>
                        setFormState({ ...formState, message: e.target.value })
                      }
                      required
                      rows={6}
                      className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      placeholder="Your message..."
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading text-lg tracking-wider"
                  >
                    {isSubmitting ? (
                      'SENDING...'
                    ) : (
                      <>
                        SEND MESSAGE
                        <Send className="ml-2 w-5 h-5" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="font-heading text-3xl tracking-wider text-foreground mb-6">
                CONTACT INFORMATION
              </h2>
              <p className="text-muted-foreground mb-8">
                You can also reach us through any of the following channels.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 mb-12">
                {contactInfo.map((info) => (
                  <div
                    key={info.title}
                    className="bg-card border border-border rounded-lg p-6"
                  >
                    <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center mb-4">
                      <info.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">
                      {info.title}
                    </h3>
                    <p className="text-primary font-medium mb-1">{info.content}</p>
                    <p className="text-sm text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 lg:py-24 bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-medium tracking-widest uppercase mb-2">
              Help Center
            </p>
            <h2 className="font-heading text-4xl tracking-wider text-foreground">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6"
              >
                <h3 className="font-medium text-foreground mb-2">
                  {faq.question}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
