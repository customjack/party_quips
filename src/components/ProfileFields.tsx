import { AVATARS, type Avatar as AvatarName } from "../domain/types";
import { Avatar } from "./Avatar";

export function ProfileFields({
  name,
  avatar,
  spectator,
  allowSpectator = true,
  onChange,
}: {
  name: string;
  avatar: AvatarName;
  spectator: boolean;
  allowSpectator?: boolean;
  onChange: (next: {
    name: string;
    avatar: AvatarName;
    spectator: boolean;
  }) => void;
}) {
  return (
    <div className="profile-fields">
      <label className="field">
        <span>Your display name</span>
        <input
          value={name}
          maxLength={24}
          onChange={(e) =>
            onChange({ name: e.target.value, avatar, spectator })
          }
        />
      </label>
      <div className="field">
        <span>Choose your icon</span>
        <div className="avatar-grid">
          {AVATARS.map((item) => (
            <button
              type="button"
              className={
                item === avatar ? "avatar-choice selected" : "avatar-choice"
              }
              onClick={() => onChange({ name, avatar: item, spectator })}
              key={item}
            >
              <Avatar name={item} />
              <span className="sr-only">{item}</span>
            </button>
          ))}
        </div>
      </div>
      {allowSpectator && (
        <label className="toggle-row">
          <span>
            <b>Join as spectator</b>
            <small>Watch and vote without answering.</small>
          </span>
          <input
            type="checkbox"
            checked={spectator}
            onChange={(e) =>
              onChange({ name, avatar, spectator: e.target.checked })
            }
          />
        </label>
      )}
    </div>
  );
}
