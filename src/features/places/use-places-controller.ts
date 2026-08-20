import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { residentPaymentsEnabled } from '@/lib/commercial-offer';
import {
  fetchCouncilAddresses,
  isUkPostcode,
  lookupNearestPostcode,
  lookupPostcode,
  ResolvedPlace,
} from '@/lib/council-provider';
import { getDeviceCoordinates } from '@/lib/device-location';
import { requiresExactCouncilAddress } from '@/lib/place-resolution';
import { councilIdsForResidentUse } from '@/lib/resident-adoption';
import { syncResidentCouncilLinks } from '@/lib/resident-council-links';
import { shareSavedPlace } from '@/lib/schedule-tools';
import { CouncilAddressOption, SavedAddress } from '@/lib/types';
import { useAppData } from '@/lib/use-app-data';
import { usePilotAnalytics } from '@/lib/use-pilot-analytics';
import { useSubscription } from '@/lib/use-subscription';

export type AddressChoice = {
  place: ResolvedPlace;
  addresses: CouncilAddressOption[];
};

export function usePlacesController() {
  const params = useLocalSearchParams<{ postcode?: string }>();
  const appData = useAppData();
  const { addresses, activeAddress, addAddress, removeAddress, setActiveAddress, refreshCollections, refreshing } = appData;
  const analytics = usePilotAnalytics();
  const subscription = useSubscription();
  const initialPostcode = typeof params.postcode === 'string' ? params.postcode : '';
  const initialLookupHandled = useRef(false);
  const [postcode, setPostcode] = useState(initialPostcode);
  const [lookupMode, setLookupMode] = useState<'postcode' | 'location'>();
  const [showAdd, setShowAdd] = useState(false);
  const [addressChoice, setAddressChoice] = useState<AddressChoice>();
  const [selectingAddressId, setSelectingAddressId] = useState<string>();
  const [resolvingExactAddress, setResolvingExactAddress] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const exactAddressRequired = activeAddress
    ? requiresExactCouncilAddress(activeAddress.providerId, activeAddress.councilAddressId)
    : false;
  const showPostcodeForm = showAdd || addresses.length === 0;

  async function saveResolvedPlace(result: ResolvedPlace, exactAddress?: CouncilAddressOption) {
    const alreadySaved = addresses.some((address) => (
      address.postcode.replace(/\s/g, '').toUpperCase() === result.postcode.replace(/\s/g, '').toUpperCase()
    ));
    if (!alreadySaved && addresses.length >= 5) {
      setFeedback({ error: true, message: 'Five-place limit reached. Remove a saved place before adding another.' });
      return;
    }
    if (!alreadySaved && addresses.length >= 1 && residentPaymentsEnabled() && !subscription.isPlus) {
      setAddressChoice(undefined);
      router.push('/plus');
      return;
    }
    if (result.providerId === 'lad-e08000011' && !exactAddress) {
      throw new Error('Choose your exact Knowsley address so the council can identify the correct collection round.');
    }
    const outcome = await addAddress({
      label: addresses.length === 0 ? 'Home' : result.councilName ?? 'Saved place',
      line1: exactAddress?.line1 ?? result.line1,
      postcode: exactAddress?.postcode ?? result.postcode,
      councilName: result.councilName ?? 'Council not matched',
      providerId: result.providerId ?? 'unconnected',
      councilAddressId: exactAddress?.id,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setPostcode('');
    setShowAdd(false);
    setAddressChoice(undefined);
    setFeedback({
      error: false,
      message: outcome.verified
        ? `${exactAddress?.postcode ?? result.postcode} is now active. ${outcome.message}`
        : `${exactAddress?.postcode ?? result.postcode} is now active. No collection date will be shown until its council source returns a verified result. ${outcome.message}`,
    });
  }

  async function continueWithResolvedPlace(result: ResolvedPlace) {
    if (result.providerId && result.providerId !== 'unconnected') {
      const councilAddresses = await fetchCouncilAddresses(result.postcode, result.providerId);
      analytics.track('address_options_loaded', {
        councilId: result.providerId,
        context: councilAddresses.length ? 'exact-address' : 'postcode-only',
        outcome: 'success',
        metricValue: Math.min(1000, councilAddresses.length),
      });
      if (councilAddresses.length === 1) {
        await saveResolvedPlace(result, councilAddresses[0]);
        return;
      }
      if (councilAddresses.length > 1) {
        setAddressChoice({ place: result, addresses: councilAddresses });
        setShowAdd(false);
        return;
      }
    }
    await saveResolvedPlace(result);
  }

  async function addPlace(postcodeValue = postcode) {
    if (!isUkPostcode(postcodeValue)) {
      analytics.track('postcode_lookup_failed', { context: 'manual', outcome: 'failure', reasonCode: 'invalid-postcode' });
      setFeedback({ error: true, message: 'Enter a full UK postcode, for example M1 1AE.' });
      return;
    }
    analytics.track('postcode_lookup_started', { context: 'manual' });
    setLookupMode('postcode');
    setFeedback(undefined);
    try {
      const result = await lookupPostcode(postcodeValue);
      analytics.track('postcode_lookup_succeeded', { councilId: result.providerId, context: 'manual', outcome: 'success' });
      void syncResidentCouncilLinks(councilIdsForResidentUse(addresses.map((address) => address.providerId), result.providerId)).catch(() => undefined);
      void analytics.syncCouncilWorkspaces(councilIdsForResidentUse(addresses.map((address) => address.providerId), result.providerId)).catch(() => undefined);
      await continueWithResolvedPlace(result);
    } catch (error) {
      analytics.track('postcode_lookup_failed', { context: 'manual', outcome: 'failure', reasonCode: 'unavailable' });
      setFeedback({ error: true, message: error instanceof Error ? error.message : 'This place could not be added. Try again in a moment.' });
    } finally {
      setLookupMode(undefined);
    }
  }

  function startAddingPlace() {
    if (addresses.length >= 5) {
      setFeedback({ error: true, message: 'Five-place limit reached. Remove a saved place before adding another.' });
      return;
    }
    if (addresses.length >= 1 && residentPaymentsEnabled() && !subscription.isPlus) {
      router.push('/plus');
      return;
    }
    setShowAdd(true);
  }

  useEffect(() => {
    if (initialLookupHandled.current || !initialPostcode || !isUkPostcode(initialPostcode)) return;
    initialLookupHandled.current = true;
    setShowAdd(true);
    void addPlace(initialPostcode);
    // The incoming postcode is a one-time continuation from Today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostcode]);

  function confirmRemoveAddress(address: SavedAddress) {
    const message = `${address.line1} and its saved collection dates will be removed from this device.`;
    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm(`Remove ${address.label}?\n\n${message}`)) removeAddress(address.id);
      return;
    }
    Alert.alert(`Remove ${address.label}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeAddress(address.id) },
    ]);
  }

  async function useCurrentLocation() {
    analytics.track('postcode_lookup_started', { context: 'location' });
    setLookupMode('location');
    setFeedback(undefined);
    try {
      const coordinates = await getDeviceCoordinates();
      const result = await lookupNearestPostcode(coordinates.latitude, coordinates.longitude);
      analytics.track('postcode_lookup_succeeded', { councilId: result.providerId, context: 'location', outcome: 'success' });
      void syncResidentCouncilLinks(councilIdsForResidentUse(addresses.map((address) => address.providerId), result.providerId)).catch(() => undefined);
      void analytics.syncCouncilWorkspaces(councilIdsForResidentUse(addresses.map((address) => address.providerId), result.providerId)).catch(() => undefined);
      await continueWithResolvedPlace(result);
    } catch (error) {
      analytics.track('postcode_lookup_failed', {
        context: 'location',
        outcome: 'failure',
        reasonCode: /permission/i.test(error instanceof Error ? error.message : '') ? 'permission-denied' : 'unavailable',
      });
      setFeedback({ error: true, message: error instanceof Error ? error.message : 'Your location could not be used. Enter a postcode instead.' });
    } finally {
      setLookupMode(undefined);
    }
  }

  async function selectExactAddress(address: CouncilAddressOption) {
    if (!addressChoice) return;
    setSelectingAddressId(address.id);
    try {
      await saveResolvedPlace(addressChoice.place, address);
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : 'This address could not be checked. Try again in a moment.' });
    } finally {
      setSelectingAddressId(undefined);
    }
  }

  async function refreshOrCompleteAddress() {
    if (!activeAddress) return;
    if (!exactAddressRequired) {
      await refreshCollections();
      return;
    }
    setResolvingExactAddress(true);
    try {
      await continueWithResolvedPlace({
        postcode: activeAddress.postcode,
        line1: activeAddress.line1,
        councilName: activeAddress.councilName,
        providerId: activeAddress.providerId,
        latitude: activeAddress.latitude,
        longitude: activeAddress.longitude,
      });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : 'This property could not be found. Try again in a moment.' });
    } finally {
      setResolvingExactAddress(false);
    }
  }

  return {
    activeAddress,
    addressChoice,
    addresses,
    confirmRemoveAddress,
    exactAddressRequired,
    feedback,
    lookupMode,
    postcode,
    refreshing,
    refreshOrCompleteAddress,
    resolvingExactAddress,
    selectExactAddress,
    selectingAddressId,
    setActiveAddress,
    setAddressChoice,
    setPostcode: (value: string) => { setPostcode(value); setFeedback(undefined); },
    setShowAdd,
    shareActivePlace: () => activeAddress ? shareSavedPlace(activeAddress) : Promise.resolve(),
    showPostcodeForm,
    startAddingPlace,
    submitPostcode: () => addPlace(),
    useCurrentLocation,
  };
}
