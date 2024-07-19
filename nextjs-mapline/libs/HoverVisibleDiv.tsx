import React from 'react';
import styled from 'styled-components';

const HoverVisibleDiv = styled.div<{ $opacity: number, $length: number, $corners: boolean, $isParent: boolean, $expanded: boolean, $isChild: boolean,
            $translateX: number, $translateY: number, $isParentExpanded: boolean, $isSelected: boolean }>`
    transform: translate(calc(${(props) => (props.$translateX || 0)}px), calc(${(props) => (props.$translateY || 0)}px + 0.1rem));
    -webkit-transform: translate(calc(${(props) => (props.$translateX || 0)}px), calc(${(props) => (props.$translateY || 0)}px + 0.1rem));
    -ms-transform: translate(calc(${(props) => (props.$translateX || 0)}px), calc(${(props) => (props.$translateY || 0)}px + 0.1rem));
    -moz-transform: translate(calc(${(props) => (props.$translateX || 0)}px), calc(${(props) => (props.$translateY || 0)}px + 0.1rem));
    
    opacity: calc(${(props) => (props.$opacity || 1)} * ${(props) => (props.$expanded || false) ? 1 : 0});
    pointer-events: ${(props) => (props.$expanded || false) ? '' : 'none'};
    border-top-right-radius: ${(props) => (props.$corners || false) ? 0 : 0.6}rem;
    border-bottom-right-radius: ${(props) => (props.$corners || false) ? 0 : 0.6}rem;
    width: calc(6rem + ${(props) => (props.$isParent || false) ? 2 : 1}rem);

    filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
            drop-shadow(0 0 0.3rem rgba(0,0,0,0.5))
            brightness(${(props) => (props.$isChild || false) ? 0.8 : 1});
    -webkit-filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
            drop-shadow(0 0 0.3rem rgba(0,0,0,0.5))
            brightness(${(props) => (props.$isChild || false) ? 0.8 : 1});

    .eventRange {
        border-top-left-radius: ${(props) => (props.$isChild || false) ? 0 : 0.6}rem;
    }

    &${(props) => !(props.$isSelected || false) && `:hover`} {
        opacity: calc(1 * ${(props) => (props.$expanded || false) ? 1 : 0});
        width: calc(${(props) => props.$length || 130}px + ${(props) => (props.$isParent || false) ? 2 : 1}rem);
        border-top-right-radius: 0.6rem;
        border-bottom-right-radius: 0.6rem;
        border-top-left-radius: 0.6rem;

        filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
            drop-shadow(0 0 0.3rem rgba(0,0,0,1))
            brightness(1);
        -webkit-filter:blur(${(props) => (props.$isChild || false) ? ((props) => (props.$expanded || false) ? 0 : 0.2) : 0}rem)
            drop-shadow(0 0 0.3rem rgba(0,0,0,1))
            brightness(1);

        .eventRange {
            border-top-left-radius: 0.6rem;
        }
    }

    
`;

export default HoverVisibleDiv;