import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { friendlySupportDate, supportStatusLabel, supportTopics } from '@/features/support/support-model';
import { supportStyles as styles } from '@/features/support/support-styles';
import { SupportController } from '@/features/support/use-support-controller';
import { useAppTheme } from '@/lib/theme';

export function SupportInbox({ controller }: { controller: SupportController }) {
  const theme = useAppTheme();
  const thread = controller.selectedThread;
  return (
    <>
      <View style={styles.topicGrid}>
        {supportTopics.map((item) => (
          <Pressable aria-checked={controller.topic === item.value} accessibilityRole="radio" accessibilityState={{ checked: controller.topic === item.value }} key={item.value} onPress={() => controller.setTopic(item.value)} style={[styles.topic, { borderColor: controller.topic === item.value ? theme.accent : theme.separator, backgroundColor: controller.topic === item.value ? theme.accentSoft : theme.surface }]}>
            <Text style={[styles.topicText, { color: controller.topic === item.value ? theme.accent : theme.text }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput accessibilityLabel="Support message" maxLength={5_000} multiline onChangeText={controller.setDetail} placeholder="Describe what happened and what you expected." placeholderTextColor={theme.tertiaryText} style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.separator, color: theme.text }]} value={controller.detail} />
      {controller.activeAddress ? <View style={styles.councilContext}><Ionicons color={theme.success} name="shield-checkmark-outline" size={17} /><Text style={[styles.councilContextText, { color: theme.secondaryText }]}>{controller.councilSupportEnabled ? `Routed to ${controller.activeAddress.councilName}. Your address and postcode are not sent.` : `Routed to What Bin support. ${controller.activeAddress.councilName} has not enabled its resident inbox.`}</Text></View> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: controller.sending }} disabled={controller.sending} onPress={() => void controller.send()} style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, pressed && styles.pressed, controller.sending && styles.disabled]}>{controller.sending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons color="#FFFFFF" name="send" size={18} /><Text style={styles.buttonText}>Send message</Text></>}</Pressable>

      {controller.error ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.danger }]}>{controller.error}</Text> : null}
      {controller.message ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.success }]}>{controller.message}</Text> : null}

      {controller.threads.length ? (
        <View style={styles.conversationSection}>
          <View style={styles.sectionHeading}><View><Text style={[styles.sectionKicker, { color: theme.secondaryText }]}>YOUR INBOX</Text><Text style={[styles.sectionTitle, { color: theme.text }]}>Conversations</Text></View><Text style={[styles.count, { color: theme.secondaryText }]}>{controller.threads.length}</Text></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadTabs}>
            {controller.threads.map((item) => {
              const selected = thread?.id === item.id;
              return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item.id} onPress={() => controller.setSelectedThreadId(item.id)} style={[styles.threadTab, { backgroundColor: selected ? theme.accentSoft : theme.surface, borderColor: selected ? theme.accent : theme.separator }]}><Text numberOfLines={1} style={[styles.threadTabTitle, { color: selected ? theme.accent : theme.text }]}>{item.subject}</Text><Text style={[styles.threadTabMeta, { color: theme.secondaryText }]}>{supportStatusLabel(item)}</Text></Pressable>;
            })}
          </ScrollView>
          {thread ? <SupportConversation controller={controller} /> : null}
        </View>
      ) : null}
    </>
  );
}

function SupportConversation({ controller }: { controller: SupportController }) {
  const theme = useAppTheme();
  const thread = controller.selectedThread;
  if (!thread) return null;
  return (
    <View style={[styles.conversation, { backgroundColor: theme.surface, borderColor: theme.separator }]}>
      <View style={[styles.conversationHead, { borderBottomColor: theme.separator }]}><View style={styles.conversationHeadCopy}><Text style={[styles.conversationTitle, { color: theme.text }]}>{thread.subject}</Text><Text style={[styles.conversationMeta, { color: theme.secondaryText }]}>{thread.councilName ? `${thread.councilName} · ` : ''}{supportStatusLabel(thread)}</Text></View><View style={[styles.statusDot, { backgroundColor: thread.status === 'waiting-resident' ? theme.success : theme.accentFill }]} /></View>
      <View style={styles.messageStack}>{thread.messages.map((item) => {
        const resident = item.sender === 'resident';
        return <View key={item.id} style={[styles.messageRow, resident && styles.messageRowResident]}><View style={[styles.messageBubble, resident ? { backgroundColor: theme.accentFill } : { backgroundColor: theme.groupedBackground, borderColor: theme.separator, borderWidth: 1 }]}><Text style={[styles.messageText, { color: resident ? '#FFFFFF' : theme.text }]}>{item.body}</Text><Text style={[styles.messageTime, { color: resident ? 'rgba(255,255,255,0.72)' : theme.secondaryText }]}>{resident ? 'You' : 'What Bin support'} · {friendlySupportDate(item.createdAt)}</Text></View></View>;
      })}</View>
      {!['resolved', 'closed'].includes(thread.status) ? (
        <View style={[styles.replyBox, { borderTopColor: theme.separator }]}><TextInput accessibilityLabel="Reply to support" maxLength={5_000} multiline onChangeText={controller.setReply} placeholder="Write a reply…" placeholderTextColor={theme.tertiaryText} style={[styles.replyInput, { backgroundColor: theme.background, color: theme.text }]} value={controller.reply} /><Pressable accessibilityLabel="Send reply" accessibilityRole="button" accessibilityState={{ disabled: controller.sending || !controller.reply.trim() }} disabled={controller.sending || !controller.reply.trim()} onPress={() => void controller.sendReply()} style={[styles.replyButton, { backgroundColor: theme.accentFill }, (!controller.reply.trim() || controller.sending) && styles.disabled]}>{controller.sending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="arrow-up" size={19} />}</Pressable></View>
      ) : thread.satisfactionScore ? (
        <View style={[styles.satisfactionResult, { borderTopColor: theme.separator }]}><Ionicons color={theme.success} name="checkmark-circle-outline" size={20} /><Text style={[styles.closedText, { color: theme.secondaryText }]}>You rated this support conversation {thread.satisfactionScore} out of 5.</Text></View>
      ) : (
        <View style={[styles.satisfaction, { borderTopColor: theme.separator }]}><Text style={[styles.satisfactionTitle, { color: theme.text }]}>Was this support helpful?</Text><Text style={[styles.satisfactionBody, { color: theme.secondaryText }]}>Your rating helps improve resident support.</Text><View accessibilityRole="radiogroup" style={styles.satisfactionScores}>{[1, 2, 3, 4, 5].map((score) => <Pressable aria-checked={false} aria-disabled={controller.sending} accessibilityLabel={`Rate support ${score} out of 5`} accessibilityRole="radio" disabled={controller.sending} key={score} onPress={() => void controller.rateSupport(score)} style={({ pressed }) => [styles.scoreButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}><Text style={[styles.scoreText, { color: theme.accent }]}>{score}</Text></Pressable>)}</View><Text style={[styles.closedText, { color: theme.secondaryText }]}>Start a new message above if you still need help.</Text></View>
      )}
    </View>
  );
}
