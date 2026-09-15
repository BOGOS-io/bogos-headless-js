import {useLoaderData, type V2_MetaFunction} from '@remix-run/react';
import {type LoaderArgs} from '@shopify/remix-oxygen';

import {useEffect} from 'react';

export const meta: V2_MetaFunction = () => {
  return [{title: `Hydrogen | Search`}];
};

export async function loader({request, context, params}: LoaderArgs) {
  const {id} = params;
  return {id};
}

export default function SearchPage() {
  const {id} = useLoaderData<typeof loader>();
  if (!id) return 'No offer page';

  useEffect(() => {
    setTimeout(() => {
      if (typeof document === 'undefined') return;

      document.dispatchEvent(new CustomEvent('bogos:offer-page-init'));
    }, 250);
  }, []);

  return <div id="bogos-offer-page-view" data-offer-id={id}></div>;
}
