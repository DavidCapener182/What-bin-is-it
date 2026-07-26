import * as Location from 'expo-location';

export async function getDeviceCoordinates() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Location permission is needed to find your postcode. You can still enter it manually.');
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    throw new Error('We could not get your current location. Check location services, then try again.');
  }
}
