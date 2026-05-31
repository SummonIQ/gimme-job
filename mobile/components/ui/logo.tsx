import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  layout?: 'horizontal' | 'stacked';
}

const SIZES = {
  sm: { icon: 30, bolt: 15, text: 14 },
  md: { icon: 38, bolt: 19, text: 16 },
  lg: { icon: 46, bolt: 23, text: 18 },
  xl: { icon: 66, bolt: 33, text: 24 },
};

function BriefcaseIcon({
  iconSize,
  boltSize,
}: {
  iconSize: number;
  boltSize: number;
}) {
  return (
    <View style={{ width: iconSize, height: iconSize }}>
      <Svg viewBox="2.5 5.9 27 24.6" width={iconSize} height={iconSize}>
        <Defs>
          <LinearGradient id="case-grad" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0%" stopColor="hsl(238.7, 80%, 55%)" />
            <Stop offset="50%" stopColor="hsl(238.7, 83.5%, 60%)" />
            <Stop offset="100%" stopColor="hsl(238.7, 85%, 66%)" />
          </LinearGradient>
          <LinearGradient id="handle-grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="hsl(245, 50%, 43%)" />
            <Stop offset="100%" stopColor="hsl(242, 60%, 55%)" />
          </LinearGradient>
          <LinearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="white" stopOpacity={0.28} />
            <Stop offset="100%" stopColor="white" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path
          d="M12.2 10L12.2 9.5C12.2 7.6 13.5 6.4 16 6.4C18.5 6.4 19.8 7.6 19.8 9.5L19.8 10L18.7 10L18.7 9.5C18.7 8.6 17.8 7.8 16 7.8C14.2 7.8 13.3 8.6 13.3 9.5L13.3 10Z"
          fill="url(#handle-grad)"
        />
        <Rect
          x="3"
          y="10"
          width="26"
          height="20"
          rx="4.5"
          fill="url(#case-grad)"
        />
        <Rect x="3" y="10" width="26" height="8" rx="4.5" fill="url(#shine)" />
        <Path
          d="M3 13.5C3 11.57 4.57 10 6.5 10H25.5C27.43 10 29 11.57 29 13.5V19Q16 20.6 3 19V13.5Z"
          fill="black"
          fillOpacity={0.1}
        />
      </Svg>
      <Svg
        viewBox="0 0 100 100"
        width={boltSize}
        height={boltSize}
        style={{
          position: 'absolute',
          left: iconSize * 0.24,
          top: iconSize * 0.22 + 8,
        }}
      >
        <Path
          d="M64 6 L28 56 H48 L36 94 L80 40 H58 Z"
          fill="#f59e0b"
          stroke="#00000080"
          strokeWidth={3}
          strokeLinejoin="miter"
        />
        <Path d="M64 6 L28 56 H48 L36 94 L80 40 H58 Z" fill="#f59e0b" />
      </Svg>
    </View>
  );
}

export function Logo({
  size = 'md',
  showText = true,
  layout = 'stacked',
}: LogoProps) {
  const s = SIZES[size];
  const isStacked = layout === 'stacked';

  return (
    <View style={isStacked ? styles.containerStacked : styles.container}>
      <BriefcaseIcon iconSize={s.icon} boltSize={s.bolt} />
      {showText && (
        <View
          style={isStacked ? styles.textContainerStacked : styles.textContainer}
        >
          <Text
            style={[
              styles.titleText,
              { fontSize: s.text },
              isStacked && styles.titleTextStacked,
            ]}
          >
            Gimme Job
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  containerStacked: {
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    justifyContent: 'center',
  },
  textContainerStacked: {
    alignItems: 'center',
  },
  titleText: {
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  titleTextStacked: {
    textAlign: 'center',
  },
});
