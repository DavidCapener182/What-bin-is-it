import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchKnowsleyMendixDates, parseKnowsleyOperations } from '../api/_gateway/knowsley-mendix.ts';

// Minimal public-form structure; operation IDs deliberately differ from both
// the old deployment and the current council deployment.
function page(search = 'aaaaaaaaaaaaaaaaaaaaaa', select = 'bbbbbbbbbbbbbbbbbbbbbb') {
  const button = (id, caption, argument, operationId) => ({
    $widgetId: `328.OnlineServices.PAGE_OS_BinCollectionInfo_Anon.${id}`,
    widget: 'ActionButton',
    props: {
      caption: { expression: { expr: { type: 'literal', value: caption } } },
      action: { action: { type: 'callMicroflow', argMap: { [argument]: {} }, config: { operationId } } },
    },
  });
  const props = JSON.stringify({ widgetTree: [{ props: { content: [
    button('actionButton4', 'Search for address', 'OS_MissedBinEnquiry', search),
    button('actionButton5', 'Choose this address', 'Generic_Address', select),
  ] } }] }).slice(1, -1).replaceAll('"', '&quot;');
  return `<m:page><div data-mendix-props='${props}'></div></m:page>`;
}

test('reads the lookup operations from the current public council form', () => {
  assert.deepEqual(parseKnowsleyOperations(page()), {
    search: 'aaaaaaaaaaaaaaaaaaaaaa', select: 'bbbbbbbbbbbbbbbbbbbbbb',
  });
});

test('rejects missing, malformed, ambiguous or unrelated form actions', () => {
  for (const input of [
    '<html>Unavailable</html>',
    page('https://elsewhere.example'),
    page().replace('OS_MissedBinEnquiry', 'Unrelated'),
    page() + page(),
    "<div data-mendix-props='invalid json'></div>",
  ]) assert.throws(() => parseKnowsleyOperations(input));
});

function mockCouncil(t, { returnedUprn = '000040017128', addressSelected = true, pageStatus = 200 } = {}) {
  const object = (guid, objectType) => ({ guid, objectType, hash: 'hash', attributes: {} });
  const enquiry = object('enquiry', 'OnlineServices.OS_vmBinCollectionEnquiry');
  const address = object('address', 'OnlineServices.OS_vmGeneric_Address');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.includes('/link/')) return new Response(null, { status: 303, headers: [
      ['set-cookie', '__Host-XASSESSIONID=session; Secure'],
      ['set-cookie', '__Host-XASID=node; Secure'],
    ] });
    if (url.includes('/pages/')) return new Response(page(), { status: pageStatus });
    const body = JSON.parse(init.body);
    calls.push(body);
    if (body.action === 'get_session_data') return Response.json({ csrftoken: 'test-token', objects: [object('redirect', 'Service_YouAreBeingRedirected.YouAreBeingRedirected_Redirect')] });
    if (body.action === 'executeaction') return Response.json({ objects: [enquiry] });
    if (body.operationId === 'aaaaaaaaaaaaaaaaaaaaaa') return Response.json({
      objects: [address], changes: { address: { UPRN: { value: '000040017128' } } },
    });
    if (body.operationId === 'bbbbbbbbbbbbbbbbbbbbbb') return Response.json({ changes: { enquiry: {
      UPRN: { value: returnedUprn }, AddressSelected: { value: addressSelected },
      NextMaroon: { value: 'Friday 11/09/2026' },
    } } });
    return new Response('Forbidden', { status: 403 });
  });
  return calls;
}

test('uses refreshed form operations through the complete exact-property lookup', async (t) => {
  const calls = mockCouncil(t);
  const dates = await fetchKnowsleyMendixDates('L36 7XA', '000040017128');
  assert.deepEqual(dates.NextMaroon, { value: 'Friday 11/09/2026' });
  assert.deepEqual(calls.filter((call) => call.operationId).map((call) => call.operationId), [
    'aaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbb',
  ]);
});

test('still rejects dates returned for a different property', async (t) => {
  mockCouncil(t, { returnedUprn: '000040017131' });
  await assert.rejects(fetchKnowsleyMendixDates('L36 7XA', '000040017128'), /different property/);
});

test('does not guess operations when the council form cannot be read', async (t) => {
  const calls = mockCouncil(t, { pageStatus: 503 });
  await assert.rejects(fetchKnowsleyMendixDates('L36 7XA', '000040017128'), /503/);
  assert.equal(calls.some((call) => call.operationId), false);
});
