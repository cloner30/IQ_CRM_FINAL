import { GroupStatusUpdater } from './GroupStatusUpdater';

/** @deprecated Use GroupStatusUpdater in the group header instead */
export const GroupStatusTab = ({ group, onUpdate }) => (
  <GroupStatusUpdater group={group} onUpdate={onUpdate} />
);

export default GroupStatusTab;
