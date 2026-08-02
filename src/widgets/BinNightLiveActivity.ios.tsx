import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { CollectionLiveSurfaceSnapshot } from './collection-live-surface-data.ts';

function BinNightLiveActivity(
  props: CollectionLiveSurfaceSnapshot,
  _environment: LiveActivityEnvironment,
) {
  'widget';
  const secondary = props.foregroundColour === '#FFFFFF' ? '#F6E8EC' : '#31404A';
  return {
    banner: (
      <HStack alignment="center" spacing={12} modifiers={[padding({ all: 14 })]}>
        <Image color={props.binColour} size={30} systemName={props.state === 'collected' ? 'checkmark.circle.fill' : 'trash.fill'} />
        <VStack alignment="leading" spacing={3}>
          <Text modifiers={[font({ design: 'rounded', size: 16, weight: 'bold' }), lineLimit(2)]}>{props.headline}</Text>
          <Text modifiers={[font({ design: 'rounded', size: 12, weight: 'medium' }), foregroundStyle(secondary), lineLimit(2)]}>{props.status}</Text>
        </VStack>
        <Spacer minLength={4} />
        <VStack alignment="trailing" spacing={2}>
          <Text modifiers={[font({ design: 'rounded', size: 12, weight: 'bold' }), foregroundStyle(props.binColour)]}>{props.countdown}</Text>
          <Text modifiers={[font({ design: 'rounded', size: 10, weight: 'medium' }), lineLimit(1)]}>{props.placeLabel}</Text>
        </VStack>
      </HStack>
    ),
    compactLeading: <Image color={props.binColour} size={14} systemName={props.state === 'collected' ? 'checkmark.circle.fill' : 'trash.fill'} />,
    compactTrailing: <Text modifiers={[font({ design: 'rounded', size: 11, weight: 'bold' }), foregroundStyle(props.binColour)]}>{props.countdown}</Text>,
    minimal: <Image color={props.binColour} size={14} systemName={props.state === 'collected' ? 'checkmark.circle.fill' : 'trash.fill'} />,
    expandedLeading: <Image color={props.binColour} size={22} systemName={props.state === 'collected' ? 'checkmark.circle.fill' : 'trash.fill'} />,
    expandedCenter: <Text modifiers={[font({ design: 'rounded', size: 15, weight: 'bold' }), lineLimit(2)]}>{props.headline}</Text>,
    expandedTrailing: <Text modifiers={[font({ design: 'rounded', size: 12, weight: 'bold' }), foregroundStyle(props.binColour)]}>{props.countdown}</Text>,
    expandedBottom: <Text modifiers={[font({ design: 'rounded', size: 12, weight: 'medium' }), lineLimit(2), padding({ top: 6, bottom: 4 })]}>{props.status} · {props.placeLabel}</Text>,
  };
}

export default createLiveActivity<CollectionLiveSurfaceSnapshot>('BinNightLiveActivity', BinNightLiveActivity);
