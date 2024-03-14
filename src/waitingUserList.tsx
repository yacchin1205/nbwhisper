import React from "react";
import { User } from "./user";
import Enumerable from "linq";

// 待機ユーザーリスト
export function WaitingUserList({
    optionalClassName = "",
    users,
    onSelect,
} : {
    optionalClassName : string,
    users : User[],
    onSelect : (index : number) => void
}) : JSX.Element {
    const [hoveringIndex, setHoveringIndex] = React.useState(-1);
    let waitingUsers = Enumerable.from(users).where(u => u.canInvite()).toArray();
    let talkingUsers = Enumerable.from(users).where(u => !u.canInvite()).toArray();
    return (
        <div className={`nbwhisper-user-list-container ${optionalClassName}`}>
            <ul>
                {
                    waitingUsers.map((user, index) => {
                        return (
                            <li key={index}>
                                {
                                    <div 
                                        className='nbwhisper-user-list-item'
                                        onMouseEnter={() => setHoveringIndex(index)}
                                        onMouseLeave={() => setHoveringIndex(-1)}
                                        onClick={() => onSelect(users.indexOf(waitingUsers[index]))}
                                    >
                                        <span className='nbwhisper-user-list-item-label'>
                                            {user.name}
                                        </span>
                                        <span className='nbwhisper-user-list-item-icons'>
                                            { (!user.is_selected && hoveringIndex == index) && <div className='nbwhisper-check-off-icon' /> }
                                            { user.is_selected && <div className='nbwhisper-check-on-icon' /> }
                                        </span>
                                    </div>
                                }
                            </li>
                        );
                    })
                }
                {
                    talkingUsers.map((user, index) => {
                        return (
                            <li key={index}>
                                {
                                    <div className='nbwhisper-user-list-item nbwhisper-list-item-disabled'>
                                        <span className='nbwhisper-user-list-item-label'>
                                            {user.name}
                                        </span>
                                        <span className='nbwhisper-user-list-item-icons'>
                                            <div className='nbwhisper-on-talking-icon' />
                                        </span>
                                    </div>
                                }
                            </li>
                        );
                    })
                }
            </ul>
        </div>
    );
}