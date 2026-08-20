import { Platform, Share } from 'react-native';

function exportFileName(now = new Date()) {
  return `what-bin-account-export-${now.toISOString().slice(0, 10)}.json`;
}

export async function presentAccountExport(payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const fileName = exportFileName();
  if (Platform.OS !== 'web') {
    await Share.share({
      message: json,
      title: 'What Bin? account export',
    });
    return 'shared' as const;
  }

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return 'downloaded' as const;
}
