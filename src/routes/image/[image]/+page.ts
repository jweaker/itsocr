import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	return {
		imageId: params.image,
		isDuplicate: url.searchParams.get('duplicate') === '1'
	};
};
