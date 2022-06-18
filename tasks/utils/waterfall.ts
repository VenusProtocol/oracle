type TashFunc = (...args: any[]) => Promise<any>;

export const waterfall = (tasks: TashFunc[]) => {
    return tasks.reduce((p: Promise<any>, fn: TashFunc) => p.then(fn), Promise.resolve())
}

