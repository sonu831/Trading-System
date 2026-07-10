import ScalpCockpit from './index';

export default function ScalpByUnderlying({ underlying }) {
  return <ScalpCockpit underlying={underlying} />;
}

export async function getServerSideProps({ params }) {
  return { props: { underlying: params.underlying } };
}
