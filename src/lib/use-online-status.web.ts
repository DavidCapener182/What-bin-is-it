import { useEffect, useState } from 'react';

function readOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(readOnlineStatus);

  useEffect(() => {
    const update = () => setOnline(readOnlineStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
