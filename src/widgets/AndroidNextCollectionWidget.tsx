'use no memo';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { CollectionWidgetSnapshot } from './widget-data.ts';

export function AndroidNextCollectionWidget({
  snapshot,
  width,
}: {
  snapshot: CollectionWidgetSnapshot;
  width: number;
}) {
  const compact = width < 240;
  const accessibilityLabel = `${snapshot.headline}. ${snapshot.detail}. ${snapshot.addressLabel}.`;

  return (
    <FlexWidget
      accessibilityLabel={accessibilityLabel}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'whatbinistonight://' }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: snapshot.binColour,
        borderRadius: 24,
        padding: compact ? 14 : 16,
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexGap: 10,
      }}>
      <FlexWidget
        style={{
          flex: 1,
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexGap: 4,
        }}>
        <TextWidget
          maxLines={1}
          text={`♻  ${snapshot.kicker}`}
          style={{
            color: snapshot.secondaryColour,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.5,
          }}
        />
        <TextWidget
          maxLines={compact ? 3 : 2}
          text={snapshot.headline}
          truncate="END"
          style={{
            color: snapshot.foregroundColour,
            fontSize: compact ? 19 : 21,
            fontWeight: '700',
          }}
        />
        {!compact ? (
          <TextWidget
            maxLines={1}
            text={snapshot.detail}
            truncate="END"
            style={{
              color: snapshot.secondaryColour,
              fontSize: 11,
              fontWeight: '500',
            }}
          />
        ) : null}
      </FlexWidget>
      <FlexWidget
        style={{
          width: compact ? 'wrap_content' : 70,
          flexDirection: 'column',
          alignItems: compact ? 'flex-start' : 'flex-end',
          justifyContent: 'center',
          flexGap: 3,
        }}>
        <TextWidget
          maxLines={1}
          text={snapshot.countdown}
          style={{
            color: snapshot.foregroundColour,
            fontSize: compact ? 13 : 15,
            fontWeight: '700',
          }}
        />
        <TextWidget
          maxLines={1}
          text={snapshot.addressLabel}
          truncate="END"
          style={{
            color: snapshot.secondaryColour,
            fontSize: 11,
            fontWeight: '600',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
