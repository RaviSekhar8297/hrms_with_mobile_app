import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, Bot, Send, User } from 'lucide-react-native';

interface Message {
  id: string | number;
  sender: 'bot' | 'user';
  text: string;
}

interface AIAssistantProps {
  onBack: () => void;
}

export const AIAssistantScreen: React.FC<AIAssistantProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: 'Hello! I am your Enterprise Smart HR AI Assistant. How can I help you today with leave balances, payslips, or company policies?' },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);

    const query = input.toLowerCase();
    let replyText = 'I have processed your request. You can check the dashboard widgets or contact HR for further assistance.';

    if (query.includes('leave') || query.includes('holiday')) {
      replyText = 'You currently have 14 total remaining leaves (9 Casual Leaves, 8 Sick Leaves, 10 Earned Leaves). Next upcoming public holiday is Gandhi Jayanti on Oct 2.';
    } else if (query.includes('salary') || query.includes('pay') || query.includes('payslip')) {
      replyText = 'Your net salary for August 2026 (₹70,000) was successfully disbursed. You can download the PDF payslip directly from the Payroll module.';
    } else if (query.includes('punch') || query.includes('attendance')) {
      replyText = 'You can register your daily attendance punch and GPS geofence location directly using the Attendance Punch In button on your home dashboard.';
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'bot', text: replyText },
      ]);
    }, 600);

    setInput('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Bot size={20} color="#4F46E5" />
          <Text style={styles.headerTitle}>Smart HR AI Assistant</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.chatContent}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.msgBubbleContainer,
              msg.sender === 'user' ? styles.userAlign : styles.botAlign,
            ]}
          >
            <View
              style={[
                styles.msgBubble,
                msg.sender === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text
                style={[
                  styles.msgText,
                  msg.sender === 'user' ? styles.userText : styles.botText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask HR AI assistant..."
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  chatContent: {
    padding: 20,
    gap: 12,
  },
  msgBubbleContainer: {
    flexDirection: 'row',
  },
  userAlign: {
    justifyContent: 'flex-end',
  },
  botAlign: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  botText: {
    color: '#111827',
  },
  userText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
