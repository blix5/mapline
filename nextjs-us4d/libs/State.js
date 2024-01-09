import useDynamicStateImport from '../libs/useDynamicStateImport';

export default function State({ name, onCompleted, onError, ...rest }) {
    const { error, loading, SvgIcon } = useDynamicStateImport(name, { onCompleted, onError });
    if(error) {
        return error.message;
    }
    if(loading) {
        return "Loading...";
    }
    if(SvgIcon) {
        return (
            <SvgIcon {...rest} />
        );
    }
    return null;
}