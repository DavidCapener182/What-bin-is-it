export type AddressState<
  Address extends { id: string; isPrimary: boolean },
  Schedule,
> = {
  addresses: Address[];
  activeAddressId: string;
  schedulesByAddressId: Record<string, Schedule>;
};

export function removeAddressFromState<
  Address extends { id: string; isPrimary: boolean },
  Schedule,
  State extends AddressState<Address, Schedule>,
>(state: State, addressId: string): State {
  if (!state.addresses.some((address) => address.id === addressId)) return state;
  const addresses = state.addresses
    .filter((address) => address.id !== addressId)
    .map((address, index) => ({ ...address, isPrimary: index === 0 }));
  const schedulesByAddressId = { ...state.schedulesByAddressId };
  delete schedulesByAddressId[addressId];
  return {
    ...state,
    addresses,
    activeAddressId: state.activeAddressId === addressId
      ? addresses[0]?.id ?? ''
      : state.activeAddressId,
    schedulesByAddressId,
  };
}
