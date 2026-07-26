import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { CollectionWidgetSnapshot } from './widget-data.ts';

function NextCollectionWidget(
  props: CollectionWidgetSnapshot,
  environment: WidgetEnvironment,
) {
  'widget';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        spacing={5}
        modifiers={[
          padding({ all: 14 }),
          containerBackground(props.binColour, 'widget'),
          widgetURL('whatbinistonight://'),
        ]}>
        <HStack alignment="center" spacing={5}>
          <Image color={props.foregroundColour} size={13} systemName="trash.fill" />
          <Text modifiers={[
            font({ design: 'rounded', size: 10, weight: 'bold' }),
            foregroundStyle(props.secondaryColour),
          ]}>
            {props.kicker}
          </Text>
        </HStack>
        <Text modifiers={[
          font({ design: 'rounded', size: 20, weight: 'bold' }),
          foregroundStyle(props.foregroundColour),
          lineLimit(3),
        ]}>
          {props.headline}
        </Text>
        <Spacer minLength={2} />
        <Text modifiers={[
          font({ design: 'rounded', size: 11, weight: 'semibold' }),
          foregroundStyle(props.secondaryColour),
          lineLimit(2),
        ]}>
          {props.countdown} · {props.addressLabel}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack
      alignment="center"
      spacing={14}
      modifiers={[
        padding({ all: 16 }),
        containerBackground(props.binColour, 'widget'),
        widgetURL('whatbinistonight://'),
      ]}>
      <VStack alignment="leading" spacing={5}>
        <HStack alignment="center" spacing={6}>
          <Image color={props.foregroundColour} size={14} systemName="trash.fill" />
          <Text modifiers={[
            font({ design: 'rounded', size: 10, weight: 'bold' }),
            foregroundStyle(props.secondaryColour),
          ]}>
            {props.kicker}
          </Text>
        </HStack>
        <Text modifiers={[
          font({ design: 'rounded', size: 21, weight: 'bold' }),
          foregroundStyle(props.foregroundColour),
          lineLimit(2),
        ]}>
          {props.headline}
        </Text>
        <Text modifiers={[
          font({ design: 'rounded', size: 11, weight: 'medium' }),
          foregroundStyle(props.secondaryColour),
          lineLimit(1),
        ]}>
          {props.detail}
        </Text>
      </VStack>
      <Spacer minLength={4} />
      <VStack alignment="trailing" spacing={4}>
        <Text modifiers={[
          font({ design: 'rounded', size: 15, weight: 'bold' }),
          foregroundStyle(props.foregroundColour),
        ]}>
          {props.countdown}
        </Text>
        <Text modifiers={[
          font({ design: 'rounded', size: 11, weight: 'semibold' }),
          foregroundStyle(props.secondaryColour),
          lineLimit(1),
        ]}>
          {props.addressLabel}
        </Text>
      </VStack>
    </HStack>
  );
}

export default createWidget<CollectionWidgetSnapshot>(
  'NextCollectionWidget',
  NextCollectionWidget,
);
